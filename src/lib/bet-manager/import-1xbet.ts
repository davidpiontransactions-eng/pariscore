// Import de tickets 1xBet — service unifié (phase P4 du plan bettrack).
// Fusionne les deux parseurs historiques :
//   - ocr.ts `parse1xbetTicket` / `parseTicketText` → texte OCR brut (scan photo)
//   - public/suivi-paris.html `parse1xbetHtml` / `parse1xbetCoupon` / `zipEntries`
//     → HTML exporté depuis l'historique 1xBet + archive ZIP du coupon
//   (le parseur DOM de suivi-paris est repris ici en extracteurs regex —
//    même sélecteurs, zéro dépendance, testable sous bun sans DOMParser)
// Dédup : `externalRef` = № du coupon, filtré par l'appelant puis verrouillé
// côté route (409) — cf. src/app/api/v1/bm/bets/route.ts.
//
// ponytail: extracteurs regex sur le gabarit FIXE de l'historique 1xBet
// (selecteurs `cupHisNew`/`table_prop`/`td.ce[rowspan]`/`#tdH`). Si 1xBet
// refond son HTML, remonter à htmlparser2 (dep à justifier en PR) — le
// plafond est le format figé, pas la profondeur du DOM.

import { parseTicketText, type OcrTicket } from "./ocr";

// ─── Types ──────────────────────────────────────────────────────────────────

export type CouponLeg = {
  pick: string;
  odds: number | null;
  statusRaw: string;
  /** "Championnat. Ligue. Événement — Équipes" issu de la cellule .ha */
  label: string | null;
  sport: string | null;
  league: string | null;
};

export type Coupon1xbet = {
  /** № du coupon (externalRef), null si absent. */
  externalRef: string | null;
  /** Date de placement AAAA-MM-JJ, null si absente. */
  placedKey: string | null;
  /** Libellé brut ("simple", "combiné", "système 2/3"...). */
  betTypeLabel: string;
  totalOdds: number | null;
  stake: number | null;
  statusRaw: string | null;
  payoutCell: number | null;
  legs: CouponLeg[];
};

/** Bet prêt pour POST /api/v1/bm/bets (champs de la route). */
export type Import1xbetBet = {
  externalRef: string | null;
  betType: "single" | "combo" | "system";
  sport: string;
  competition: string | null;
  matchLabel: string;
  market: string | null;
  pick: string | null;
  stake: number;
  odds: number;
  status: "pending" | "won" | "lost" | "void" | "cashout";
  payout: number | null;
  profit: number | null;
  /** Date de placement (AAAA-MM-JJ, compatible new Date() ISO). */
  placedAt: string | null;
  bookmaker: "1xbet";
  legs: { matchLabel: string; market?: string; pick?: string; odds: number }[];
};

export type Ingest1xbetResult = {
  source: "zip" | "html" | "text";
  coupons: Coupon1xbet[];
  bets: Import1xbetBet[];
  /** Paris écartés car externalRef déjà présent dans existingRefs. */
  duplicates: number;
  skippedRefs: string[];
  summary: { count: number | null; gains: number | null; unsettled: number | null } | null;
};

// ─── Utilitaires ────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

/** "10.00 EUR" / "18,50 €" / "1 234,56" → nombre (parseNum de suivi-paris). */
export function parseNum(v: string | null | undefined): number | null {
  if (!v) return null;
  let s = decodeEntities(String(v)).replace(/[\u00a0\u202f\u2009\s]/g, "").replace(/[€$£]/g, "");
  s = s.replace(/(\d),(?=\d{3}(\D|$))/g, "$1");
  s = s.replace(",", ".");
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ");
}

// ─── Statuts (STATUS_MAP de suivi-paris) ────────────────────────────────────

const STATUS_MAP: [RegExp, Import1xbetBet["status"]][] = [
  [/^(non trait|non pay|en cours|en direct|non r[eé]gl|pending|unresolved|unsettled|open)/i, "pending"],
  [/^(pay[eé]|gagn[eé]e?|won|win|succ[eè]s|combin[ée] gagn)/i, "won"],
  [/^(perdue?|lost|lose|[eé]chec)/i, "lost"],
  [/^(rembours[eé]|annul[eé]e?|refunded|refund|void|cashback|sold)/i, "void"],
  [/^(cashout|cash out)/i, "cashout"],
];

export function mapStatus(raw: string | null | undefined): { status: Import1xbetBet["status"]; known: boolean } {
  if (!raw) return { status: "pending", known: false };
  const s = String(raw).replace(/\s+/g, " ").trim();
  if (!s) return { status: "pending", known: false };
  for (const [re, st] of STATUS_MAP) if (re.test(s)) return { status: st, known: true };
  return { status: "pending", known: false };
}

// ─── Cellule événement (.ha, port de parseEventCell) ────────────────────────

function parseEventCell(cellHtml: string): { sport: string | null; league: string | null; label: string | null } {
  const b = cellHtml.match(/<b[^>]*>([\s\S]*?)<\/b>/i);
  if (!b) return { sport: null, league: null, label: null };
  const lines = decodeEntities(b[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const first = lines[0] || "";
  const parts = first.split(/\.\s+/).map((s) => s.trim()).filter(Boolean);
  let sport: string | null = null;
  let league: string | null = null;
  let event = first;
  if (parts.length >= 3) {
    sport = parts[0];
    league = parts.slice(1, parts.length - 1).join(". ");
    event = parts[parts.length - 1];
  } else if (parts.length === 2) {
    sport = parts[0];
    event = parts[1];
  }
  const teams = lines[1] || null;
  return { sport, league, label: [event, teams].filter(Boolean).join(" — ") || null };
}

// ─── Coupon (port de parse1xbetCoupon en extracteurs regex) ─────────────────

function parse1xbetCoupon(block: string): Coupon1xbet {
  // № du coupon : son obligation évite de capturer la date comme identifiant.
  let externalRef: string | null = null;
  const idInput = block.match(/id="hisChekHide-(\d+)"/);
  if (idInput) externalRef = idInput[1];
  if (!externalRef) {
    const m = block.match(/\u2116\s*(\d{4,})/) || block.match(/№\s*(\d{4,})/);
    if (m) externalRef = m[1];
  }

  // Date de placement (première date JJ.MM.AAAA du bloc)
  let placedKey: string | null = null;
  const dm = block.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dm) {
    placedKey = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  }

  const bt = block.match(/Type de pari\s*:\s*([^<]+)/i);
  const betTypeLabel = (bt ? bt[1] : "Simple").trim().toLowerCase();

  let totalOdds = parseNum((block.match(/id="tdH"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] ?? null);
  if (totalOdds === null) totalOdds = parseNum((block.match(/class="hisCof"[^>]*>([\s\S]*?)<\/td>/i) || [])[1] ?? null);

  // Lignes du tableau : legs (rowspan=2) + pied (#tdH)
  const legs: CouponLeg[] = [];
  let stake: number | null = null;
  let statusRaw: string | null = null;
  let payoutCell: number | null = null;
  const tableMatch = block.match(/<table[^>]*class="[^"]*table_prop[^"]*"[\s\S]*?<\/table>/i);
  const tableHtml = tableMatch ? tableMatch[0] : block;
  const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    if (/rowspan\s*=\s*["']?2/i.test(row)) {
      const ces = [...row.matchAll(/<td[^>]*class="[^"]*\bce\b[^"]*"[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
        stripTags(m[1]).trim()
      );
      if (ces.length >= 2) {
        const ha = row.match(/<td[^>]*class="[^"]*\bha\b[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        const ev = parseEventCell(ha ? ha[1] : "");
        legs.push({
          pick: ces[0],
          odds: parseNum(ces[1]),
          statusRaw: ces[2] ?? "",
          label: ev.label,
          sport: ev.sport,
          league: ev.league,
        });
      }
      continue;
    }
    if (/id="tdH"/i.test(row)) {
      const ces = [...row.matchAll(/<td[^>]*class="[^"]*\bce\b[^"]*"[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
        stripTags(m[1]).trim()
      );
      if (ces.length >= 2) statusRaw = ces[ces.length - 1];
      if (ces.length >= 1) stake = parseNum(ces[0]);
      if (ces.length >= 3) payoutCell = parseNum(ces[ces.length - 2]);
    }
  }

  // Repli de mise : cellule d'intitulé suivie de la valeur ("Mise totale" → "40 EUR")
  if (stake === null) {
    const sm = block.match(/(mise totale|montant du pari|stake)[^<]*<\/[^>]+>\s*<[^>]+>([\s\S]{0,40})/i);
    if (sm) stake = parseNum(sm[2]);
    if (stake === null) {
      const inline = block.match(/(mise totale|montant du pari)\s*:?\s*([\d.,]+)\s*(?:EUR|€)?/i);
      if (inline) stake = parseNum(inline[2]);
    }
  }
  if (totalOdds === null && legs.length === 1 && legs[0].odds !== null) totalOdds = legs[0].odds;

  return { externalRef, placedKey, betTypeLabel, totalOdds, stake, statusRaw, payoutCell, legs };
}

// ─── Page HTML d'historique (port de parse1xbetHtml) ────────────────────────

export function parse1xbetHtml(html: string): {
  summary: { count: number | null; gains: number | null; unsettled: number | null } | null;
  coupons: Coupon1xbet[];
} {
  // Blocs : découpe sur le MARQUEUR cupHisNew (pas sur l'équilibre des div).
  let blocks = html.split(/class=["']cupHisNew["']/i).slice(1).map((b) => b);
  if (blocks.length === 0) {
    // Repli : chaque table.table_prop porte un coupon
    blocks = html.match(/<table[^>]*class="[^"]*table_prop[^"]*"[\s\S]*?<\/table>/gi) || [];
  }
  const coupons = blocks.map(parse1xbetCoupon).filter((c) => c.placedKey !== null || c.stake !== null);

  // Résumé (.cupHisZ) : Nombre de paris / Total des gains / non traités
  let summary: { count: number | null; gains: number | null; unsettled: number | null } | null = null;
  const zi = html.search(/class=["'][^"']*cupHisZ/i);
  if (zi >= 0) {
    const txt = stripTags(html.slice(zi, zi + 800)).replace(/\s+/g, " ");
    const grab = (label: string): number | null => {
      const i = txt.toLowerCase().indexOf(label.toLowerCase());
      if (i < 0) return null;
      return parseNum(txt.slice(i + label.length, i + label.length + 48));
    };
    summary = { count: grab("Nombre de paris"), gains: grab("Total des gains"), unsettled: grab("Montant des paris non trait") };
  }
  return { summary, coupons };
}

// ─── Coupon → Bet ───────────────────────────────────────────────────────────

const SPORT_ALIASES: Record<string, string> = {
  football: "football",
  soccer: "football",
  tennis: "tennis",
  basketball: "basketball",
  basket: "basketball",
  handball: "handball",
  hockey: "hockey",
  volleyball: "volleyball",
  baseball: "baseball",
  rugby: "rugby",
  mma: "mma",
  boxe: "boxing",
  boxing: "boxing",
  cyclisme: "cycling",
  cycling: "cycling",
  "f1": "f1",
};

export function couponToBet(c: Coupon1xbet): Import1xbetBet | null {
  const valid = c.legs.filter((l) => l.pick && (l.odds ?? 0) > 1);
  if (valid.length === 0) return null;

  const betType: Import1xbetBet["betType"] = /combin|parlay/i.test(c.betTypeLabel)
    ? "combo"
    : /syst/i.test(c.betTypeLabel)
      ? "system"
      : valid.length > 1
        ? "combo"
        : "single";

  const legs = valid.map((l) => ({
    matchLabel: l.label || l.league || "Événement 1xBet",
    pick: l.pick,
    odds: l.odds as number,
  }));
  const odds = c.totalOdds ?? legs.reduce((acc, l) => acc * l.odds, 1);
  const stake = c.stake ?? 0;
  const { status } = mapStatus(c.statusRaw);
  const payout =
    status === "pending"
      ? null
      : status === "won"
        ? (c.payoutCell ?? (stake > 0 ? stake * odds : null))
        : status === "lost"
          ? 0
          : c.payoutCell ?? stake; // void / cashout
  const sportRaw = (valid[0].sport ?? "").toLowerCase().trim();
  const first = valid[0];

  return {
    externalRef: c.externalRef,
    betType,
    sport: SPORT_ALIASES[sportRaw] ?? (sportRaw || "other"),
    competition: first.league,
    matchLabel: betType === "single" ? legs[0].matchLabel : `${legs.length} sélections`,
    market: betType === "single" ? null : "Combiné",
    pick: first.pick,
    stake,
    odds: Math.round(odds * 100) / 100,
    status,
    payout: payout !== null ? Math.round(payout * 100) / 100 : null,
    profit: payout !== null ? Math.round((payout - stake) * 100) / 100 : null,
    placedAt: c.placedKey,
    bookmaker: "1xbet",
    legs,
  };
}

/** Ticket OCR (OcrTicket) → Bet prêt à soumettre. */
export function ocrTicketToBet(t: OcrTicket): Import1xbetBet | null {
  const valid = t.legs.filter((l) => (l.odds ?? 0) > 1);
  const odds = t.odds ?? (valid.length ? valid.reduce((a, l) => a + (l.odds ?? 1), 1) : 0);
  if (!t.matchLabel && odds <= 1) return null;
  const ref = t.rawText.match(/(?:\u2116|N°|n°)\s*(?:de coupon\s*)?:?\s*(\d{4,})/i)?.[1] ?? null;
  const legs = valid.map((l) => ({ matchLabel: l.matchLabel, market: l.market, pick: l.pick, odds: l.odds as number }));
  return {
    externalRef: ref,
    betType: t.betType === "combo" && legs.length > 1 ? "combo" : "single",
    sport: "other",
    competition: null,
    matchLabel: t.matchLabel ?? "Ticket 1xBet",
    market: t.market ?? null,
    pick: t.pick ?? null,
    stake: t.stake ?? 0,
    odds: Math.round(odds * 100) / 100,
    status: "pending",
    payout: null,
    profit: null,
    placedAt: null,
    bookmaker: "1xbet",
    legs: legs.length > 1 ? legs : [],
  };
}

// ─── ZIP natif (zipEntries / inflateRaw de suivi-paris, zéro dépendance) ────

export function zipEntries(buf: ArrayBuffer): { name: string; method: number; data: Uint8Array }[] {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let eocd = -1;
  const lo = Math.max(0, buf.byteLength - 22 - 65535);
  for (let i = buf.byteLength - 22; i >= lo; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Archive ZIP invalide (fin de répertoire central introuvable).");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const out: { name: string; method: number; data: Uint8Array }[] = [];
  for (let i = 0; i < count; i++) {
    if (off + 46 > buf.byteLength || dv.getUint32(off, true) !== 0x02014b50)
      throw new Error(`Entrée ZIP corrompue (index ${i}).`);
    const method = dv.getUint16(off + 10, true);
    let csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true);
    const elen = dv.getUint16(off + 30, true);
    const clen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nlen));
    if (dv.getUint32(lho, true) !== 0x04034b50 || lho + 30 > buf.byteLength)
      throw new Error(`En-tête local absent ou hors bornes pour « ${name} ».`);
    const lnlen = dv.getUint16(lho + 26, true);
    const lelen = dv.getUint16(lho + 28, true);
    if (!csize) csize = dv.getUint32(lho + 18, true); /* flag data-descriptor */
    const start = lho + 30 + lnlen + lelen;
    out.push({ name, method, data: u8.subarray(start, start + csize) });
    off += 46 + nlen + elen + clen;
  }
  return out;
}

async function inflateRaw(bytes: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return bytes;
  if (method !== 8) throw new Error(`Compression ZIP non gérée (méthode ${method}).`);
  if (typeof DecompressionStream === "undefined")
    throw new Error("Décompression deflate non disponible dans cet environnement.");
  const LIMIT = 64 * 1024 * 1024;
  const reader = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    n += step.value.length;
    if (n > LIMIT) {
      try {
        await reader.cancel();
      } catch {
        /* annulation déjà en vol */
      }
      throw new Error("Archive trop volumineuse une fois décompressée (> 64 Mo).");
    }
    chunks.push(step.value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Première entrée texte du ZIP (préfère .html/.htm). */
export async function extractZipText(buf: ArrayBuffer): Promise<string> {
  const entries = zipEntries(buf);
  const pick = entries.find((e) => /\.html?$/i.test(e.name)) ?? entries[0];
  if (!pick) throw new Error("Archive ZIP vide.");
  const data = await inflateRaw(pick.data, pick.method);
  return new TextDecoder().decode(data);
}

// ─── Point d'entrée unique ──────────────────────────────────────────────────

export function detect1xbetSource(input: string | ArrayBuffer | Uint8Array): "zip" | "html" | "text" {
  if (input instanceof ArrayBuffer) {
    const u8 = new Uint8Array(input);
    return u8[0] === 0x50 && u8[1] === 0x4b ? "zip" : "text";
  }
  if (input instanceof Uint8Array) {
    return input[0] === 0x50 && input[1] === 0x4b ? "zip" : "text";
  }
  const head = input.slice(0, 512).replace(/^\uFEFF/, "").trimStart();
  if (head.startsWith("PK")) return "zip";
  if (/^<(!doctype|html|head|body|div|table|!doctype html)/i.test(head) || /class=["'][^"']*cupHis/i.test(input))
    return "html";
  return "text";
}

/**
 * Ingestion universelle : ZIP du coupon, page HTML d'historique, ou texte OCR.
 * `existingRefs` = № de coupons déjà importés → doublons écartés (le verrou
 * définitif reste le 409 de POST /bm/bets).
 */
export async function ingest1xbet(
  input: string | ArrayBuffer | Uint8Array,
  opts: { existingRefs?: Iterable<string> } = {}
): Promise<Ingest1xbetResult> {
  const existing = new Set(opts.existingRefs ?? []);
  let source = detect1xbetSource(input);
  let text: string | null = typeof input === "string" ? input : null;
  if (source === "zip") {
    const buf = input instanceof ArrayBuffer ? input : input instanceof Uint8Array ? (input.buffer as ArrayBuffer).slice(input.byteOffset, input.byteOffset + input.byteLength) : null;
    if (!buf) throw new Error("Archive ZIP invalide.");
    text = await extractZipText(buf);
    source = "zip";
  }

  if (text !== null && (source === "html" || detect1xbetSource(text) === "html")) {
    const { summary, coupons } = parse1xbetHtml(text);
    const all = coupons.map(couponToBet).filter((b): b is Import1xbetBet => b !== null);
    const bets = all.filter((b) => !(b.externalRef && existing.has(b.externalRef)));
    return {
      source, // "html" ou "zip" (archive décompressée) — pas codé en dur
      coupons,
      bets,
      duplicates: all.length - bets.length,
      skippedRefs: all.filter((b) => b.externalRef && existing.has(b.externalRef)).map((b) => b.externalRef as string),
      summary,
    };
  }

  // Texte brut : chemin OCR historique (parse1xbetTicket → fallback générique)
  const ticket = parseTicketText(text ?? "");
  const bet = ocrTicketToBet(ticket);
  const bets = bet && !(bet.externalRef && existing.has(bet.externalRef)) ? [bet] : [];
  return {
    source: "text",
    coupons: [],
    bets,
    duplicates: bet && bets.length === 0 ? 1 : 0,
    skippedRefs: bet && bets.length === 0 ? [bet.externalRef as string] : [],
    summary: null,
  };
}
