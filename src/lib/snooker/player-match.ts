/**
 * Utilitaire de matching joueurs snooker entre sources.
 *
 * FlashScore : "O'Sullivan R.", "Trump J.", "Wilson K."
 * CueTracker : "Ronnie O'Sullivan", "Judd Trump", "Kyren Wilson"
 * Oddsportal : "osullivan r.", "trump j.", "wilson k."
 *
 * Stratégie :
 * 1. Mapping direct (FS_TO_CUE_ID) pour les joueurs connus
 * 2. Normalisation + matching par last name + initiale
 * 3. Fallback : distance de Levenshtein pour typos
 */

// ─── Mapping FlashScore / Oddsportal → CueTracker ID ──────────────────────

const FS_TO_CUE_ID: Record<string, string> = {
  // Top players
  "osullivan r.": "ronnie-osullivan", "o'sullivan r.": "ronnie-osullivan",
  "trump j.": "judd-trump", "selby m.": "mark-selby",
  "robertson n.": "neil-robertson", "higgins j.": "john-higgins",
  "williams m.": "mark-williams", "murphy s.": "shaun-murphy",
  "wilson k.": "kyren-wilson", "ding j.": "ding-junhui",
  "allen m.": "mark-allen", "lisowski j.": "jack-lisowski",
  "hawkins b.": "barry-hawkins", "carter a.": "ali-carter",
  "bingham s.": "stuart-bingham", "maguire s.": "stephen-maguire",
  "zhou y.": "zhou-yuelong", "page j.": "jackson-page",
  "saengkham n.": "noppon-saengkham", "pang j.": "pang-junxu",
  "xiao g.": "xiao-guodong", "wu y.": "wu-yize",
  "gilbert d.": "david-gilbert", "jones j.": "jamie-jones",
  "ford t.": "tom-ford", "wilson g.": "gary-wilson",
  "yuan s.": "yuan-sijun", "dale d.": "dominic-dale",
  "dott g.": "graeme-dott", "holt m.": "michael-holt",
  "gould m.": "martin-gould", "perry j.": "joe-perry",
  "un-nooh t.": "thepchaiya-un-nooh", "vafaei h.": "hussain-vafaei",
  "wakelin c.": "chris-wakelin", "white j.": "jimmy-white",
  "milkins r.": "rob-milkins", "burden a.": "alfie-burden",
  "higginson a.": "andrew-higginson", "carty a.": "ashley-carty",
  "wells d.": "daniel-wells", "slessor e.": "elliott-slessor",
  "odonnell m.": "martin-odonnell", "carrington s.": "stuart-carrington",
  "pinhey h.": "haydon-pinhey", "brown j.": "jordan-brown",
  "kowalski a.": "antoni-kowalski", "zizins a.": "artemijs-zizins",
  "lei p.": "julian-lei", "muir r.": "ross-muir",
  "xianbo w.": "wang-xinbo", "fan z.": "fan-zhengyi",
  "si x.": "si-xiaohan", "yang g.": "yu-yang",
  "lyu h.": "lyu-haotian", "clarke j.": "james-clarke",
  "hill a.": "aaron-hill", "davies l.": "liam-davies",
  "brown o.": "oliver-brown",
  // Oddsportal NIO players
  "baranowski m.": "mateusz-baranowski", "gong c.": "chenzhi-gong",
  "benzey c.": "connor-benzey", "yang l.": "liu-yang",
  "evans r.": "reanne-evans", "jiahao h.": "jiahao-huang",
  "graham l.": "liam-graham", "xinbo w.": "wang-xinbo",
  "boiko i.": "iulian-boiko", "zetao l.": "luo-zetao",
  "davies l. j.": "liam-james-davies", "miah h.": "hammad-miah",
  "quinn f.": "fergal-quinn", "burns i.": "ian-burns",
  "fu m.": "marco-fu", "connolly j.": "james-connolly",
  "hanyang z.": "zhang-hanyang", "el hareedy m.": "mohamed-elhareedy",
  "xu yi chen": "xu-yi-chen", "awad m.": "mina-awad",
  "heathcote l.": "louis-heathcote",
};

// ─── Normalisation ─────────────────────────────────────────────────────────

/** Supprime accents, ponctuation, compresse espaces. */
function normalize(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalisation légère pour le lookup direct (garde les points pour les initiales). */
function normalizeLight(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrait les tokens d'un nom (mots). */
function tokens(name: string): string[] {
  return normalize(name).split(" ").filter(Boolean);
}

// ─── Index normalisé du mapping FS_TO_CUE_ID ──────────────────────────────

/** Mappe les clés normalisées (sans ponctuation) vers les IDs CueTracker. */
const NORMALIZED_CUE_MAP: Map<string, string> = new Map(
  Object.entries(FS_TO_CUE_ID).map(([k, v]) => [normalize(k), v]),
);

// ─── Index joueur ──────────────────────────────────────────────────────────

export type PlayerLike = {
  id: string;
  name: string;
  matches_played?: number;
  wins?: number;
  [key: string]: unknown;
};

/** Crée un index de recherche par tokens pour résolution rapide. */
export function buildPlayerIndex(players: PlayerLike[]): Map<string, PlayerLike[]> {
  const index = new Map<string, PlayerLike[]>();
  for (const p of players) {
    const toks = tokens(p.name);
    if (toks.length === 0) continue;
    // Indexer par premier et dernier token (last name en ordre western/asiatique)
    const keys = new Set<string>([toks[0], toks[toks.length - 1]]);
    for (const k of keys) {
      const list = index.get(k);
      if (list) list.push(p);
      else index.set(k, [p]);
    }
  }
  return index;
}

// ─── Résolution joueur ─────────────────────────────────────────────────────

/**
 * Retrouve un joueur CueTracker depuis un nom FlashScore/Oddsportal.
 *
 * Exemples :
 * - "O'Sullivan R." → "Ronnie O'Sullivan"
 * - "Trump J." → "Judd Trump"
 * - "Ding J." → "Ding Junhui"
 * - "heathcote l." → "Louis Heathcote"
 */
export function findCuePlayer(
  sourceName: string,
  index: Map<string, PlayerLike[]>,
  allPlayers?: PlayerLike[],
): PlayerLike | null {
  const key = normalize(sourceName);
  if (!key) return null;

  // 1. Mapping direct (FS_TO_CUE_ID) — clés normalisées
  const cueId = NORMALIZED_CUE_MAP.get(key);
  if (cueId && allPlayers) {
    const found = allPlayers.find((p) => p.id === cueId);
    if (found) return found;
  }

  // 2. Parsing du nom source
  const toks = key.split(" ").filter(Boolean);
  if (toks.length === 0) return null;

  let surnames: string[];
  let initial: string | null = null;

  if (toks.length === 1) {
    // "heathcote" → chercher par last name
    surnames = [toks[0]];
  } else if (toks[toks.length - 1].length === 1) {
    // "o sullivan r" ou "trump j" → last name(s) + initiale
    // FlashScore: "Surname I." → le dernier token est l'initiale
    // Le(s) token(s) avant l'initiale = surname (peut être multi-mots : "o sullivan")
    initial = toks[toks.length - 1][0];
    const surnameTokens = toks.slice(0, toks.length - 1);
    surnames = [surnameTokens.join("")]; // "o sullivan" → "osullivan"
    // Aussi essayer le dernier token du surname (utile pour "ding j." → "ding")
    if (surnameTokens.length > 1) {
      surnames.push(surnameTokens[surnameTokens.length - 1]);
    }
  } else if (toks[0].length === 1) {
    // "r. osullivan" → initiale + last name
    surnames = [toks.slice(1).join("")];
    initial = toks[0][0];
  } else {
    // Nom complet : essayer les deux ordres
    surnames = [toks[toks.length - 1], toks[0]];
  }

  // 3. Recherche par surname + filtre initiale
  // Essayer chaque token du surname individuellement ("o", "sullivan") ET le complet ("osullivan")
  // pour gérer les noms composés et les apostrophes (O'Sullivan → tokens ["o", "sullivan"])
  const surnameVariants = [...new Set([...surnames, ...surnames.flatMap((s) => s.split(" ").filter(Boolean))])];
  for (const surname of surnameVariants) {
    const candidates = (index.get(surname) ?? []).filter((p) => {
      if (!initial) return true;
      const pToks = tokens(p.name);
      return pToks.some((t) => t.startsWith(initial));
    });
    if (candidates.length > 0) {
      // Désambiguïsation : joueur le plus expérimenté
      return candidates.sort(
        (a, b) => (b.matches_played ?? 0) - (a.matches_played ?? 0),
      )[0];
    }
  }

  // 4. Fallback : distance de Levenshtein (typos)
  if (allPlayers) {
    let bestDist = Infinity;
    let bestMatch: PlayerLike | null = null;
    for (const p of allPlayers) {
      const d = levenshtein(key, normalize(p.name));
      if (d < bestDist && d <= 3) {
        bestDist = d;
        bestMatch = p;
      }
    }
    if (bestMatch) return bestMatch;
  }

  return null;
}

// ─── Distance de Levenshtein ───────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[la][lb];
}
