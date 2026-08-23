"use client";

// OCR de ticket de pari — côté client uniquement (tesseract.js utilise WebAssembly + web workers).

import type { OcrTicket } from "./ocr";

/**
 * OCR d'une image de ticket via tesseract.js (import dynamique, ~2 Mo).
 * Ne fonctionne qu'en environnement navigateur.
 */
export async function ocrTicketImage(image: Blob): Promise<OcrTicket> {
  // Import dynamique via variable pour éviter l'analyse statique Next.js
  // tesseract.js utilise WebAssembly + web workers (incompatible SSR)
  const tess = await import(/* webpackIgnore: true */ "tesseract.js");
  const { createWorker } = tess;
  const worker = await createWorker("fra", 1, { logger: () => {} });
  try {
    const { data } = await worker.recognize(image);
    return parseTicketText(data.text);
  } finally {
    await worker.terminate();
  }
}

// Copie locale de parseTicketText pour éviter l'import circulaire
function cleanNumber(s: string): number | undefined {
  const n = parseFloat(s.replace(/[^\d.,]/g, "").replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const RX_STAKE = /(?:montant\s*(?:du\s*)?(?:pari|mise)|mise\s*totale|total\s*stake|stake)/i;
const RX_POTENTIAL = /(?:gain\s*(?:possible|potentiel)|potential\s*(?:payout|winning)|to\s*win|gain\s*total)/i;
const RX_TOTAL_ODDS = /(?:cote\s*totale|total\s*odds|odds\s*total)/i;
const RX_COUPON = /(?:n[o°]\s*(?:de\s*)?coupon|coupon\s*(?:number|id)|bet\s*id|ticket\s*n[o°])/i;

function parseTicketText(raw: string): OcrTicket {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const oddsMatches = raw.match(/(?<![\d.])([1-9]\d{0,1}[.,]\d{2})(?![\d.])/g);
  const odds = oddsMatches?.length
    ? Math.max(...oddsMatches.map((x) => parseFloat(x.replace(",", "."))))
    : undefined;
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