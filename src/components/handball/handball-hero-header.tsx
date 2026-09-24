"use client";

/**
 * HandballHeroHeader — Encart haut de page onglet Handball (miroir HockeyHeroHeader).
 * Accroche 60 minutes + 3 stratégies (Over/Under, Value) + visuel silhouette/photo.
 * Teinte bleu ciel #38bdf8, CTA unique #00e676, halo #00e676 sur le visuel.
 */

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Timer, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOT } from "@/components/football/fotmob-theme";

// Bleu ciel charte handball (déco) — texte lisible en #0288d1 sur fond clair
const SKY = "#38bdf8";
const SKY_INK = "#0288d1";
const CTA = "#00e676";

type HandballHeroStrategy = {
  key: string;
  label: string;
  desc: string;
};

const HANDBALL_STRATEGIES: HandballHeroStrategy[] = [
  { key: "over55", label: "Over 55.5", desc: "Ligne Over + proba modèle PPG" },
  { key: "under62", label: "Under 62.5", desc: "Ligne Under + proba modèle PPG" },
  { key: "valueBet", label: "Value EV+", desc: "Edge positif, mise Kelly" },
];

/** Fond mesh grainy bleu ciel (miroir hockey, teinte handball). */
function GrainMesh() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            `radial-gradient(900px 380px at 12% -10%, rgba(56,189,248,0.45), transparent 60%),` +
            `radial-gradient(700px 340px at 88% 0%, rgba(0,230,118,0.22), transparent 62%),` +
            `radial-gradient(800px 420px at 55% 115%, rgba(2,136,209,0.16), transparent 65%),` +
            `linear-gradient(180deg, #f8fcfe 0%, #eef7fc 55%, #f8fcfe 100%)`,
        }}
      />
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]" aria-hidden>
        <filter id="handballGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#handballGrain)" />
      </svg>
    </>
  );
}

/** Sphère glass flottante (miroir hockey — animation coupée si reduced motion). */
function GlassOrb({
  className,
  size,
  hue,
  delay = 0,
  reduceMotion,
}: {
  className?: string;
  size: number;
  hue: string;
  delay?: number;
  reduceMotion: boolean;
}) {
  return (
    <span
      className={cn("pointer-events-none absolute rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95), ${hue} 42%, rgba(255,255,255,0.12) 78%)`,
        boxShadow: `inset 0 -${size / 5}px ${size / 3}px rgba(2,136,209,0.25), 0 ${size / 6}px ${size / 2.2}px rgba(2,136,209,0.18)`,
        animation: reduceMotion ? undefined : `handballOrbFloat 7s ease-in-out ${delay}s infinite`,
      }}
      aria-hidden
    />
  );
}

/** Lignes de terrain stylisées (touche terrain + but, miroir RinkLines hockey). */
function CourtLines() {
  return (
    <svg
      viewBox="0 0 600 200"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <line x1="300" y1="0" x2="300" y2="200" stroke={SKY} strokeWidth="2" opacity="0.25" />
      <circle cx="300" cy="100" r="46" fill="none" stroke={SKY_INK} strokeWidth="2" opacity="0.2" />
      <circle cx="300" cy="100" r="3" fill={SKY_INK} opacity="0.3" />
      {/* Zones 6 mètres */}
      <path d="M20 60 A 50 50 0 0 1 20 140" fill="none" stroke={SKY_INK} strokeWidth="2" opacity="0.22" />
      <path d="M580 60 A 50 50 0 0 0 580 140" fill="none" stroke={SKY_INK} strokeWidth="2" opacity="0.22" />
      {/* Lignes de touche pointillées */}
      <line x1="0" y1="100" x2="600" y2="100" stroke={SKY} strokeWidth="1" strokeDasharray="8 6" opacity="0.2" />
    </svg>
  );
}

const SILHOUETTE_SRC = "/images/handball/silhouette-couple.svg";
const FALLBACK_SRC = "/images/handball/hero-action.jpg";

export function HandballHeroHeader({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  // Visuel combo : silhouette SVG en premier, photo hero en repli si erreur
  const [visualSrc, setVisualSrc] = useState<string>(SILHOUETTE_SRC);

  const containerVariants = useMemo(
    () => ({
      hidden: {},
      visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
    }),
    [],
  );

  const itemVariants = useMemo(
    () => ({
      hidden: reduceMotion ? {} : { opacity: 0, y: 14 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const } },
    }),
    [reduceMotion],
  );

  // CTA unique : défile vers les matchs (respecte reduced motion)
  const scrollToMatches = () => {
    window.scrollBy({ top: 420, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <section
      className={cn("relative overflow-hidden rounded-2xl", className)}
      style={{ backgroundColor: FOT.card, border: `1px solid ${FOT.border}` }}
    >
      <style>{`@keyframes handballOrbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@media (prefers-reduced-motion: reduce){span[style*="handballOrbFloat"]{animation:none}}`}</style>
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        <GrainMesh />
        <CourtLines />
        <GlassOrb className="right-[8%] top-[12%]" size={88} hue="rgba(56,189,248,0.55)" reduceMotion={reduceMotion} />
        <GlassOrb className="right-[22%] top-[52%]" size={54} hue="rgba(0,230,118,0.4)" delay={1.2} reduceMotion={reduceMotion} />
        <GlassOrb className="left-[4%] bottom-[8%]" size={38} hue="rgba(2,136,209,0.4)" delay={2.1} reduceMotion={reduceMotion} />
        {/* Voile clair */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(105deg, rgba(255,255,255,0.72) 0%, rgba(232,245,252,0.35) 55%, rgba(255,255,255,0.72) 100%)" }}
        />

        <div className="relative px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            {/* Bloc gauche : accroche */}
            <div className="min-w-0 flex-1">
              <motion.div variants={itemVariants} className="flex items-center gap-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#04121f]">
                  <Timer className="h-4 w-4" style={{ color: SKY }} />
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em]"
                  style={{ backgroundColor: "#04121f", color: SKY }}
                >
                  Handball • Prédictions
                </span>
              </motion.div>

              <motion.h1
                variants={itemVariants}
                className="mt-3 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl"
                style={{ color: FOT.ink, letterSpacing: "-0.03em" }}
              >
                60 minutes, 60 buts,
                <br />
                <span style={{ color: SKY_INK }}>1 seul bon pick.</span>
              </motion.h1>

              <motion.p variants={itemVariants} className="mt-3 max-w-lg text-sm leading-relaxed" style={{ color: FOT.muted }}>
                Modèle <span className="font-semibold" style={{ color: FOT.ink }}>PPG</span> + lignes{" "}
                <span className="font-semibold" style={{ color: SKY_INK }}>Over/Under</span> sur chaque match — pick, proba, EV.
              </motion.p>

              {/* CTA primaire unique */}
              <motion.div variants={itemVariants} className="mt-4">
                <button
                  type="button"
                  onClick={scrollToMatches}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ backgroundColor: CTA, color: "#04121f" }}
                >
                  <Target className="h-4 w-4" aria-hidden />
                  Voir les picks du jour
                </button>
              </motion.div>
            </div>

            {/* Bloc droit : visuel combo + 3 mini-cartes stratégie */}
            <motion.div variants={itemVariants} className="shrink-0 lg:max-w-xs w-full">
              {/* Visuel : silhouette teintée primaire, photo en repli + halo */}
              <div
                className="relative overflow-hidden rounded-xl"
                style={{
                  backgroundColor: "#04121f",
                  border: `1px solid ${FOT.border}`,
                  boxShadow: "0 0 48px rgba(0,230,118,0.35), 0 8px 24px rgba(2,136,209,0.2)",
                }}
              >
                {/* Balise img locale voulue (asset public statique) */}
                <img
                  src={visualSrc}
                  alt="Silhouette de joueurs de handball — visuel hero"
                  className="h-36 w-full object-contain p-3 text-[#00e676] [&_path]:fill-current"
                  style={{ color: CTA }}
                  onError={() => {
                    // Repli photo si le SVG est indisponible (évite la boucle)
                    if (visualSrc !== FALLBACK_SRC) setVisualSrc(FALLBACK_SRC);
                  }}
                />
                <span
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
                  style={{ background: `linear-gradient(180deg, transparent, ${SKY}33)` }}
                  aria-hidden
                />
              </div>

              <div className="mt-3 rounded-xl p-4" style={{ backgroundColor: FOT.soft, border: `1px solid ${FOT.border}` }}>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                    <Zap className="h-4 w-4" style={{ color: SKY_INK }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: FOT.muted }}>
                    3 stratégies pick
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {HANDBALL_STRATEGIES.map((s) => (
                    <div
                      key={s.key}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                      style={{ border: `1px solid ${FOT.border}` }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold" style={{ color: FOT.ink }}>{s.label}</p>
                        <p className="truncate text-[10px]" style={{ color: FOT.muted }}>{s.desc}</p>
                      </div>
                      <span
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums"
                        style={{ backgroundColor: "rgba(0,230,118,0.12)", color: "#007a3d" }}
                      >
                        EV+
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
