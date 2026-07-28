/**
 * Son d'alerte "poc de balle de tennis" — synthétisé en Web Audio API.
 *
 * Pas besoin de fichier MP3/WAV externe : on génère le son à la volée.
 * Profil : impact court (fréquence haute ~800Hz qui descend à ~300Hz en 60ms)
 * + un léger rebond ~120ms après. Évoque le "poc" caractéristique d'une balle
 * de tennis frappée fort — reconnaissable et lié au sport sans être agressif.
 *
 * Théorie audio : un impact de balle = bruit d'attaque transitoire (hautes
 * fréquences qui décroissent vite) + une résonance grave courte. On modélise
 * ça avec 2 oscillateurs (triangle pour le corps, square pour l'attaque)
 * traversés par un gain en enveloppe ADSR très courte.
 *
 * Compatibilité : Web Audio API supportée par tous les navigateurs modernes
 * (Chrome, Edge, Firefox, Safari, Brave). Le AudioContext doit être créé/
 * repris après un user gesture (sinon bloqué par autoplay policy) — c'est
 * garanti ici car le son est déclenché par une alerte liée au toggle 🔔 (geste
 * utilisateur explicite qui active les notifications).
 */

// Singleton AudioContext — recréer un context à chaque son est coûteux et
// peut planter certains navigateurs (limite de contexts). On le lazy-init.
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) {
    // Reprendre si suspendu (autoplay policy : context démarre suspended tant
    // qu'aucun geste utilisateur n'a eu lieu).
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return audioCtx;
  }
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    return null;
  }
  return audioCtx;
}

type SoundVariant = "value" | "bet";

/**
 * Joue le "poc" de balle de tennis.
 * @param variant — "value" (alerte 🔥, 2 pocs rapprochés pour signal fort)
 *                  "bet" (feu tricolore ✅, 1 poc simple).
 */
export function playTennisSound(variant: SoundVariant = "bet"): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (variant === "value") {
    // 2 pocs rapprochés (effet "poc-poc" = double break / signal fort).
    playPoc(ctx, 0);
    playPoc(ctx, 0.16);
  } else {
    // 1 poc simple (feu tricolole ✅).
    playPoc(ctx, 0);
  }
}

/**
 * Synthétise UN poc de balle (impact + résonance).
 * @param ctx — AudioContext partagé.
 * @param offset — Décalage temporel (seconds) depuis maintenant.
 */
function playPoc(ctx: AudioContext, offset: number): void {
  const now = ctx.currentTime + offset;

  // --- Oscillateur 1 : impact (attaque haute fréquence qui chute vite) ---
  // Triangle = spectre harmonique doux (moins agressif que square/sawtooth).
  const osc1 = ctx.createOscillator();
  osc1.type = "triangle";
  // Fréquence qui descend de 850Hz à 280Hz en 60ms = effet "poc" (impact).
  osc1.frequency.setValueAtTime(850, now);
  osc1.frequency.exponentialRampToValueAtTime(280, now + 0.06);

  // Enveloppe de gain ADSR courte (attaque 3ms, decay 80ms → silence).
  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(0.0001, now);
  gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.003); // attaque
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.08); // decay

  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.1);

  // --- Oscillateur 2 : résonance grave (corps du son, plus longue) ---
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(180, now);
  osc2.frequency.exponentialRampToValueAtTime(120, now + 0.12);

  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0.0001, now);
  gain2.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.16);
}
