// Import Excel .xlsx → CSV compatible parseBetsCSV (mission 2026-10-07).
//
// Pipeline : SheetJS (import DYNAMIQUE, le bundle ne charge qu'au clic) lit le
// classeur → première feuille produisant au moins une ligne EXPLOITABLE
// (cote > 1 ou mise ≠ 0) → en-têtes mappés vers les champs Bet par synonymes
// FR/EN → colonnes non reconnues CONCATÉNÉES dans `note` (lecture sans perte :
// aucune colonne n'est jetée, chaque cellule conservée est tracée) → CSV au
// format betsToCSV réutilisé tel quel par l'aperçu et /api/v1/bm/import/csv.
//
// Garde-fous : lignes sans cote ni mise ignorées (compteur droppedRows) ;
// mise négative = valeur absolue + mention dans note (calc.xlsx Feuille2 F2
// porte la formule au signe faux, anomalie 4.4 de la spec, canon |E/(D−1)|) ;
// sérial Excel date converti UNIQUEMENT sur la colonne date (20000-60000).
//
// ponytail: les valeurs texte perdent virgules et sauts de ligne (→ « · »)
// car parseBetsCSV sépare les champs à la virgule brute — si un import massif
// réclame des libellés avec virgules, migrer vers createBet en boucle ou un
// parseur CSV RFC4180.

import type { Bet } from "./types";

/** Colonnes cibles du schéma Bet et synonymes d'en-têtes acceptés (normalisés). */
const HEADER_SYNONYMS: Record<string, string[]> = {
  placedAt: ["date", "jour", "day", "placedat", "placed at", "date de placement", "date de pari"],
  sport: ["sport"],
  competition: ["competition", "ligue", "championnat", "tournoi", "tournament", "league"],
  matchLabel: ["match", "pari", "rencontre", "event", "evenement", "événement", "matchup", "duel", "match / evenement", "match/event"],
  market: ["marche", "marché", "market"],
  pick: ["pronostic", "pick", "selection", "sélection", "choix", "selection/joueur"],
  stake: ["mise", "stake", "montant", "mise moyenne", "mise (eur)", "mise (€)", "mise totale", "mise engagee"],
  odds: ["cote", "odds", "cote moyenne", "cote decimale", "cote décimale", "cote totale", "cote cible"],
  status: ["resultat", "résultat", "statut", "status", "issue", "gain/perte", "gagne/perdu"],
  payout: ["payout", "profit", "gain net", "net", "rendement"],
  bookmaker: ["bookmaker", "book", "parieur", "operateur", "opérateur", "plateforme"],
  tipster: ["tipster", "conseil", "source"],
  category: ["categorie", "catégorie", "category"],
  tags: ["tags", "etiquettes"],
  note: ["note", "notes", "commentaire", "commentaires", "remarque"],
};

/** En-têtes porteurs d'un objectif : conservés dans note (pas un champ Bet). */
const OBJECTIVE_HEADERS = [
  "objectif",
  "a faire",
  "a faire par jour",
  "gain a faire",
  "gain vise",
  "epart",
  "retard",
  "cible",
  "target",
];

/** Statuts FR/EN → BetStatus (clés normalisées SANS accents). */
const STATUS_MAP: Record<string, Bet["status"]> = {
  "en cours": "pending",
  pending: "pending",
  attente: "pending",
  gagne: "won",
  won: "won",
  win: "won",
  perdu: "lost",
  lost: "lost",
  lose: "lost",
  rembourse: "void",
  void: "void",
  annule: "void",
  cashout: "cashout",
  "cash out": "cashout",
};

export type XlsxImportResult = {
  /** CSV au format betsToCSV, prêt pour parseBetsCSV et POST /import/csv. */
  csv: string;
  sheetName: string;
  /** En-têtes source de la feuille (toutes colonnes lues). */
  headers: string[];
  /** header source → champ Bet cible (ou "note …" pour les colonnes conservées). */
  mapping: Record<string, string>;
  /** Colonnes reportées dans note faute de champ Bet correspondant. */
  intoNote: string[];
  /** Lignes écrites dans le csv. */
  rowCount: number;
  /** Lignes ignorées (aucune cote > 1 ni mise exploitable). */
  droppedRows: number;
};

const TARGET_HEADER = "placedAt,sport,competition,match,market,pick,stake,odds,status,payout,bookmaker,tipster,category,tags,note";

/** Normalise un en-tête/valeur : minuscules, sans accents, espaces réduits. */
export function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[*:()€$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cellule texte → valeur CSV sûre (pas de virgule/saut de ligne pour parseBetsCSV). */
function csvSafe(v: string): string {
  return v
    .replace(/[\r\n]+/g, " ")
    .replace(/,/g, " · ")
    .replace(/"/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cellToText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return String(v);
}

/** Colonne date : sérial Excel (feuilles sans style) ou Date SheetJS (heure LOCALE). */
function dateCellToText(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    // SheetJS construit la Date à minuit LOCAL du sérial → formatter en local,
    // jamais en UTC (décalage d'un jour aux frontières).
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = cellToText(v);
  const n = Number(s);
  if (s !== "" && Number.isInteger(n) && n > 20000 && n < 60000) {
    return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
  }
  return s;
}

function mapHeader(norm: string): string | null {
  if (!norm) return null;
  for (const [target, syns] of Object.entries(HEADER_SYNONYMS)) {
    if (syns.includes(norm)) return target;
  }
  return null;
}

function isObjectiveHeader(norm: string): boolean {
  return OBJECTIVE_HEADERS.some((o) => norm === o || norm.startsWith(o + " "));
}

type SheetConversion = {
  name: string;
  headers: string[];
  mapping: Record<string, string>;
  intoNote: string[];
  csvRows: string[];
  dropped: number;
};

/**
 * Convertit une feuille en lignes CSV (vide si aucune ligne exploitable).
 * `rows` contient TOUTES les lignes (index aligné sur les numéros Excel) pour
 * pouvoir remonter les formules non évaluées (`.f`) quand la valeur cache est
 * absente — cas réel : calc.xlsx Feuille2!F2 « =E2/(1-D2) » sans `<v>`.
 */
function convertSheet(
  name: string,
  rows: unknown[][],
  cellFormulaAt: ((rowIdx: number, colIdx: number) => string | null) | null
): SheetConversion | null {
  const headerRow = rows[0];
  const headers = headerRow.map((h) => cellToText(h));

  const mapping: Record<string, string> = {};
  const targetIndex: Record<string, number> = {};
  const noteCols: { idx: number; header: string }[] = [];
  const intoNote: string[] = [];
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    const target = mapHeader(norm);
    const key = h || `col${i + 1}`;
    if (target && !(target in targetIndex)) {
      mapping[key] = target;
      targetIndex[target] = i;
    } else {
      const isObj = isObjectiveHeader(norm);
      mapping[key] = isObj ? "note (objectif)" : "note (conservée)";
      noteCols.push({ idx: i, header: key });
      intoNote.push(key);
    }
  });

  const csvRows: string[] = [];
  let dropped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => c === null || c === "")) continue; // ligne vide réelle
    const get = (t: string) => (t in targetIndex ? cellToText(row[targetIndex[t]]) : "");
    const getDate = (t: string) =>
      t in targetIndex ? dateCellToText(row[targetIndex[t]]) : "";
    /** Formule source conservée quand la valeur cache est absente (sans-perte). */
    const formulaNote = (t: string): string => {
      if (!(t in targetIndex) || get(t) !== "") return "";
      const f = cellFormulaAt?.(r, targetIndex[t]);
      return f ? `${t}=${f} (formule non évaluée)` : "";
    };

    let stakeRaw = get("stake");
    const odds = get("odds");
    const stakeNum = Number(stakeRaw.replace(",", "."));
    let extraNote = formulaNote("stake") || formulaNote("odds");
    if (stakeRaw !== "" && !isNaN(stakeNum) && stakeNum < 0) {
      // Formule de signe faux (calc Feuille2 F2) : valeur absolue tracée dans note.
      stakeRaw = String(Math.abs(stakeNum));
      extraNote = extraNote ? `${extraNote} ; ` : "";
      extraNote += `|mise source ${stakeNum} : valeur absolue appliquée`;
    }

    // Ligne non exploitable comme pari : ni cote valide, ni mise renseignée.
    const oddsNum = Number(odds.replace(",", "."));
    const exploitable = oddsNum > 1 || (stakeRaw !== "" && !isNaN(stakeNum) && stakeNum !== 0);
    if (!exploitable) {
      dropped++;
      continue;
    }

    const rawStatus = normalizeHeader(get("status"));
    const status = STATUS_MAP[rawStatus] ?? "";
    const note = [
      // Colonnes en note : valeur, ou formule non évaluée si vide (sans-perte).
      ...noteCols
        .map(({ idx, header }) => {
          const v = cellToText(row[idx]);
          if (v !== "") return `${header}=${v}`;
          const f = cellFormulaAt?.(r, idx);
          return f ? `${header}=${f} (formule non évaluée)` : null;
        })
        .filter((s): s is string => s !== null),
      extraNote,
    ]
      .filter(Boolean)
      .join(" ; ");

    const values = [
      getDate("placedAt"),
      get("sport"),
      get("competition"),
      get("matchLabel"),
      get("market"),
      get("pick"),
      stakeRaw,
      odds,
      status,
      get("payout"),
      get("bookmaker"),
      get("tipster"),
      get("category"),
      get("tags"),
      note,
    ].map(csvSafe);
    csvRows.push(values.map((v) => `"${v}"`).join(","));
  }

  if (csvRows.length === 0) return null;
  return { name, headers, mapping, intoNote, csvRows, dropped };
}

/**
 * Parse un classeur .xlsx : première feuille produisant ≥ 1 ligne exploitable,
 * convertie en CSV Bet-Manager avec mapping traçable de toutes les colonnes.
 */
export async function xlsxToBetCsv(buf: ArrayBuffer): Promise<XlsxImportResult> {
  const XLSX = await import("xlsx");
  // sheetStubs:true — INDISPENSABLE : une cellule t="n" avec <f> mais sans <v>
  // (cas calc.xlsx Feuille2) serait SINON jetée entièrement par SheetJS (xlsx.js
  // ~14929 « if(!sheetStubs) continue »), ce qui perd la formule.
  const wb = XLSX.read(buf, { type: "array", cellDates: true, cellFormula: true, sheetStubs: true });

  const attempts: { name: string; dropped: number }[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    // blankrows:true → index de ligne aligné sur les numéros Excel (lecture des formules)
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: true });
    if (rows.length < 2) continue;
    const cellFormulaAt = (r: number, c: number): string | null => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell && cell.f ? String(cell.f) : null;
    };
    const conv = convertSheet(name, rows, cellFormulaAt);
    if (conv) {
      return {
        csv: [TARGET_HEADER, ...conv.csvRows].join("\n"),
        sheetName: conv.name,
        headers: conv.headers,
        mapping: conv.mapping,
        intoNote: conv.intoNote,
        rowCount: conv.csvRows.length,
        droppedRows: conv.dropped,
      };
    }
    attempts.push({ name, dropped: rows.length - 1 });
  }

  const detail = attempts.length
    ? ` (feuilles lues : ${attempts.map((a) => `${a.name} sans cote/mise`).join(", ")})`
    : "";
  throw new Error(`Aucune ligne exploitable : il faut une colonne cote > 1 ou mise non vide${detail}.`);
}
