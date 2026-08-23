"use client";

// OCR de ticket de pari — côté client uniquement (tesseract.js utilise WebAssembly + web workers).

import type { OcrTicket } from "./ocr";

/**
 * OCR d'une image de ticket via tesseract.js (import dynamique, ~2 Mo).
 * Ne fonctionne qu'en environnement navigateur.
 */
export async function ocrTicketImage(image: Blob): Promise<OcrTicket> {
  // Import dynamique : tesseract.js utilise WebAssembly + web workers
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("fra", 1, { logger: () => {} });
  try {
    const { data } = await worker.recognize(image);
    return parseTicketText(data.text);
  } finally {
    await worker.terminate();
  }
}