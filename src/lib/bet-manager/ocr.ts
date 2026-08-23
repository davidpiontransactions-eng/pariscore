// OCR de ticket de pari — parser dédié au format 1xbet (FR/EN) + fallback générique.
// 100% local via tesseract.js, aucune image ne quitte le navigateur.

export type OcrLeg = {
  matchLabel: string;
  market?: string;
  pick?: string;
  odds?: number;
};

export type OcrTicket = {
  rawText: string;
  matchLabel?: string;
  pick?: string;
  market?: string;
  odds?: number;
  stake?: number;
  bookmaker?: string;
  legs: OcrLeg[];
  betType: "single" | "combo";
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function cleanNumber(s: string): number | undefined {
  const n = parseFloat(s.replace(/[^\d.,]/g, "").replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
}

/** "1.85" / "2,10" / "18,50 €" → nombre. */
function num(token: string): number | undefined {
  const m = token.match(/(\d+(?:[.,]\d{1,2})?)/g);
  if (!m) return undefined;
  // Dernier nombre du token (après symbole monétaire éventuel)
  return cleanNumber(m[m.length - 1]);
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// ─── Parser dédié 1xbet ──────────────────────────────────────────────────────

// Termes structurels des tickets 1xbet (FR + EN)
const RX_STAKE = /(?:montant\s*(?:du\s*)?(?:pari|mise)|mise\s*totale|total\s*stake|stake)/i;
const RX_POTENTIAL = /(?:gain\s*(?:possible|potentiel)|potential\s*(?:payout|winning)|to\s*win|gain\s*total)/i;
const RX_TOTAL_ODDS = /(?:cote\s*totale|total\s*odds|odds\s*total)/i;
const RX_COUPON = /(?:n[o°]\s*(?:de\s*)?coupon|coupon\s*(?:number|id)|bet\s*id|ticket\s*n[o°])/i;
const RX_EVENT_HEADER = /(?:faire\s*un|faites\s*votre|résultat|result|score\s*exact|total\s*buts|handicap|les\s*deux|both\s*teams|double\s*chance|vainqueur|winner|1x2|over|under|plus\s*de|moins\s*de|combinaison|parlay)/i;

/** Marchés 1xbet FR courants → libellé canonique du module. */
const MARKET_MAP: [RegExp, string][] = [
  [/resultat\s*(du\s*match)?|match\s*winner|1x2/i, "1X2"],
  [/total\s*buts|over\s*under|plus\s*de|moins\s*de|total\s*goals/i, "Over/Under"],
  [/les\s*deux\s*(equipes|marquent)|both\s*teams\s*to\s*score|btts/i, "BTTS"],
  [/double\s*chance/i, "Double chance"],
  [/handicap/i, "Handicap"],
  [/vainqueur|winner/i, "Vainqueur"],
];

function canonicalMarket(line: string): string | undefined {
  const n = normalize(line);
  for (const [rx, label] of MARKET_MAP) if (rx.test(n)) return label;
  return undefined;
}

/** Détecte une ligne "équipe A — équipe B" (vs/dash) sans montants. */
function isEventLine(line: string): boolean {
  if (line.length < 5 || line.length > 60) return false;
  if (/\d{2}:\d{2}/.test(line) && line.length < 12) return false; // heure seule
  if (/[€$£]/.test(line)) return false;
  if (/\d+[.,]\d{2}/.test(line) && !/\s(—|–|-|vs\.?)\s/i.test(line)) return false; // montant/cote
  return /\s+(—|–|-|vs\.?)\s+/i.test(line);
}

/** Extrait les paires "équipe A — équipe B" d'une ligne. */
function splitEvent(line: string): [string, string] | null {
  const m = line.split(/\s+(?:—|–|-|vs\.?)\s+/i);
  if (m.length < 2) return null;
  return [m[0].trim(), m.slice(1).join(" - ").trim()];
}

/**
 * Parse le texte OCR d'un ticket 1xbet :
 *   - ligne événement "PSG — Olympique de Marseille"
 *   - en-tête marché "Résultat du match :"
 *   - sélection "Paris Saint-Germain va gagner" + cote "1.85"
 *   - pied "Montant du pari 10 €" / "Gain possible 18,50 €" / "Cote totale 4.25"
 * Retourne legs (combiné si >1), mise, cote, et le label marché canonique.
 */
export function parse1xbetTicket(raw: string): OcrTicket {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  const legs: OcrLeg[] = [];
  let stake: number | undefined;
  let totalOdds: number | undefined;
  let market: string | undefined;
  let lastEvent: string | null = null;
  let lastMarketHint: string | undefined;

  for (const line of lines) {
    const n = normalize(line);

    // Pied de ticket : mise
    if (RX_STAKE.test(n) && !stake) {
      const v = num(line);
      if (v !== undefined && v > 0) stake = v;
      continue;
    }
    // Pied : gain possible — ignoré (pas un champ du module)
    if (RX_POTENTIAL.test(n)) continue;
    // Pied : cote totale
    if (RX_TOTAL_ODDS.test(n)) {
      const v = num(line);
      if (v !== undefined && v > 1) totalOdds = v;
      continue;
    }
    if (RX_COUPON.test(n)) continue;

    // Ligne événement → ouvre un leg
    if (isEventLine(line)) {
      lastEvent = line.replace(/\s+(—|–|-|vs\.?)\s+/i, " vs ");
      continue;
    }

    // En-tête de marché → mémorise pour le prochain leg
    const hint = canonicalMarket(line);
    if (hint && line.length < 50 && !/\d+[.,]\d{2}/.test(line)) {
      lastMarketHint = hint;
      continue;
    }

    // Ligne sélection avec cote : "PSG gagne 1.85" / "Over 2.5 1.72"
    const oddsInLine = line.match(/(\d+[.,]\d{2})(?!\d)/g);
    if (oddsInLine && lastEvent) {
      const odds = cleanNumber(oddsInLine[oddsInLine.length - 1]);
      const pickText = line
        .replace(/(\d+[.,]\d{2})/g, "")
        .replace(/[|•]/g, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/[:;]\s*$/, "")
        .trim();
      if (odds && odds > 1 && odds < 1000) {
        legs.push({
          matchLabel: lastEvent,
          market: lastMarketHint,
          pick: pickText || lastMarketHint,
          odds,
        });
        lastEvent = null; // leg consommé
        lastMarketHint = undefined;
        continue;
      }
    }
  }

  // Assemblage
  if (legs.length > 0) {
    const betType = legs.length > 1 ? "combo" : "single";
    const first = legs[0];
    const matchLabel =
      legs.length > 1 ? `${legs.length} sélections` : first.matchLabel;
    const odds =
      legs.length > 1
        ? totalOdds ?? legs.reduce((acc, l) => acc * (l.odds ?? 1), 1)
        : (first.odds ?? totalOdds ?? 1);
    return {
      rawText: raw,
      matchLabel,
      pick: first.pick,
      market: legs.length > 1 ? "Combiné" : first.market,
      odds: Math.round(odds * 100) / 100,
      stake,
      bookmaker: "1xbet",
      legs,
      betType,
    };
  }

  return { rawText: raw, legs: [], betType: "single", stake, bookmaker: "1xbet" };
}

// ─── Fallback générique (non-1xbet) ─────────────────────────────────────────

export function parseTicketText(raw: string): OcrTicket {
  const one = parse1xbetTicket(raw);
  if (one.legs.length > 0 || one.stake !== undefined || one.odds !== undefined) return one;

  // Ancienne heuristique générique
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const oddsMatches = raw.match(/(?<![\d.])([1-9]\d{0,1}[.,]\d{2})(?![\d.])/g);
  const odds = oddsMatches?.length
    ? Math.max(...oddsMatches.map((x) => parseFloat(x.replace(",", "."))))
    : undefined;
  // Mise : dernier montant suivi d'un symbole monétaire, ligne par ligne
  let stake: number | undefined;
  for (const l of lines) {
    const m = l.match(/([\d\s.,]+)\s*[€$£]/i);
    if (m) {
      const v = cleanNumber(m[1]);
      if (v !== undefined && v > 0) stake = v;
    }
  }
  const participants = lines
    .filter(
      (l) =>
        !/^(total|gain|cote|mise|solde|date|réf|coupon|montant)/i.test(l) &&
        !/[€$£]/.test(l) &&
        !/\d{2,}[.,]\d{2}/.test(l) &&
        l.length > 2
    )
    .slice(-2);
  return {
    rawText: raw,
    matchLabel: participants.length >= 2 ? participants.join(" vs ") : participants[0],
    pick: participants[participants.length - 1],
    odds,
    stake,
    bookmaker: "1xbet",
    legs: [],
    betType: "single",
  };
}