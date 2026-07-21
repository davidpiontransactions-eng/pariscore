// Player photo resolution for real-API matches.
//
// For known players (the 6 we track in `tennis-data.ts` PHOTO_URLS), use
// the licensed OSS-hosted photos already shipped with the app.
//
// For ~90 ATP/WTA players (see `tennis-player-photos.json` at repo root),
// use the public Tennis Warehouse headshots CDN.
//
// For any other player, fall back to a DiceBear initials avatar —
// deterministic per name, so the same player always gets the same avatar
// across requests.
//
// All URLs are remote (no local image bundling required). The avatar
// service is `https://api.dicebear.com/7.x/initials/svg` which returns
// a deterministic SVG given a seed string.

import { MATCHES } from "@/lib/tennis-data";
// Static mapping name → Tennis Warehouse headshot URL. Loaded once at
// module init. Keys are lowercase full names ("jannik sinner").
import tennisWarehousePhotos from "@/../tennis-player-photos.json";

/**
 * Pre-shipped player photos (sourced via image-search, OSS-hosted).
 * Mirrors the `PHOTO_URLS` const in `tennis-data.ts` (kept private there)
 * so we can reuse them for real-API matches when the player name matches.
 */
const KNOWN_PHOTOS: Record<string, string> = {
  sabalenka: "https://sfile.chatglm.cn/images-ppt/cb2fb094e8bd.jpg",
  osaka: "https://sfile.chatglm.cn/images-ppt/f277d164b034.jpg",
  alcaraz: "https://sfile.chatglm.cn/images-ppt/987e0dbb7368.jpg",
  rublev: "https://sfile.chatglm.cn/images-ppt/765d3f71ab16.jpg",
  sinner: "https://sfile.chatglm.cn/images-ppt/f3083e0d32c5.jpg",
  medvedev: "https://sfile.chatglm.cn/images-ppt/05c2dd9ee59d.jpg",
};

/**
 * Build a name → photo URL lookup table from the seeded mock matches +
 * the Tennis Warehouse CDN mapping.
 *
 * Resolution layers (checked in order by `resolvePlayerPhoto`):
 *   1. OSS-hosted photos (6 stars) — highest quality, licensed
 *   2. Tennis Warehouse headshots (~90 ATP/WTA players)
 * Lets us reuse the photo for a known player even if their id differs
 * (e.g. an ATP match returned by The Odds API for Alcaraz will reuse
 * the seeded Alcaraz photo).
 */
const NAME_TO_PHOTO: Map<string, string> = (() => {
  const m = new Map<string, string>();
  // Layer 1 — 6 stars (OSS, licensed)
  for (const match of MATCHES) {
    for (const p of [match.playerA, match.playerB]) {
      m.set(p.name.toLowerCase(), p.photoUrl);
    }
  }
  for (const [id, url] of Object.entries(KNOWN_PHOTOS)) {
    // Use the id as a fallback key — the matcher will fill the name.
    m.set(id.toLowerCase(), url);
  }
  // Layer 2 — ~90 ATP/WTA players (Tennis Warehouse CDN). Only set if
  // not already covered by the OSS layer (don't downgrade a licensed
  // photo to a CDN one for the 6 stars).
  for (const [name, url] of Object.entries(tennisWarehousePhotos)) {
    if (!m.has(name.toLowerCase())) {
      m.set(name.toLowerCase(), url);
    }
  }
  return m;
})();

/**
 * DiceBear initials avatar URL.
 *
 * Deterministic per `name` — the same name always yields the same
 * initials avatar. Used as the fallback for players not in our
 * pre-shipped photo set.
 */
function diceBearInitials(name: string): string {
  const seed = encodeURIComponent(name.trim() || "Tennis Player");
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundType=gradientLinear&fontWeight=600`;
}

/**
 * Resolve a player photo URL.
 *
 * Resolution order:
 *   1. Exact seeded name (case-insensitive) → pre-shipped photo
 *   2. Fuzzy partial seeded name (handles "A. Sabalenka" vs
 *      "Aryna Sabalenka") → pre-shipped photo
 *   3. Player id known in PHOTO_URLS → pre-shipped photo
 *   4. Fallback → DiceBear initials avatar (deterministic per name)
 */
export function resolvePlayerPhoto(name: string, playerId?: string): string {
  const lc = name.toLowerCase();

  // 1. Exact name match
  const exact = NAME_TO_PHOTO.get(lc);
  if (exact) return exact;

  // 2. Fuzzy partial — e.g. "A. Sabalenka" matches "Aryna Sabalenka"
  for (const [key, url] of NAME_TO_PHOTO) {
    // Strip diacritics + punctuation, then check if either token
    // contains the other (handles "A. Sabalenka" ↔ "Aryna Sabalenka"
    // via the shared "sabalenka" substring).
    const k = normalize(key);
    const n = normalize(lc);
    if (k.length < 4 || n.length < 4) continue;
    if (k.includes(n) || n.includes(k)) return url;
  }

  // 3. Player id match
  if (playerId) {
    const idPhoto = KNOWN_PHOTOS[playerId.toLowerCase()];
    if (idPhoto) return idPhoto;
  }

  // 4. DiceBear fallback
  return diceBearInitials(name);
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9 ]/gi, "") // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
}
