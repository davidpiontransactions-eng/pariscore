"use client";

// OCR de ticket de pari — côté client uniquement (tesseract.js utilise WebAssembly + web workers).

import type { OcrTicket } from "./ocr";

/**
 * OCR d'une image de ticket via tesseract.js chargé depuis CDN.
 * Ne fonctionne qu'en environnement navigateur.
 */
export async function ocrTicketImage(image: Blob): Promise<OcrTicket> {
  // Charger tesseract.js depuis CDN pour éviter les problèmes de build Next.js
  if (typeof window === "undefined") {
    throw new Error("OCR uniquement disponible côté client");
  }

  // @ts-ignore - Tesseract sera chargé globalement via CDN
  if (!window.Tesseract) {
    await loadTesseractFromCDN();
  }

  // @ts-ignore
  const { createWorker } = window.Tesseract;
  const worker = await createWorker("fra", 1, { logger: () => {} });
  try {
    const { data } = await worker.recognize(image);
    return parseTicketText(data.text);
  } finally {
    await worker.terminate();
  }
}

function loadTesseractFromCDN(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Pas de window"));
      return;
    }
    // @ts-ignore
    if (window.Tesseract) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Échec chargement tesseract.js depuis CDN"));
    document.head.appendChild(script);
  });
}

// Copie locale de parseTicketText pour éviter l'import circulaire
function cleanNumber(s: string): number | undefined {
  const n = parseFloat(s.replace(/[^\d.,]/g, "").replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
}

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