"use client";

/**
 * BasketballHeroHeader — Encart haut de l'onglet Basket (miroir HandballHeroHeader).
 * Accroche + 3 compteurs live temps réel (en direct / à venir / ligues suivies)
 * + terrain stylisé orange parquet. Aucun asset image : tout est SVG/CSS, donc
 * aucun risque d'image cassée. Rendu en tête de BasketballTabContent.
 *
 * Les compteurs sont fournis par le parent (déjà calculés depuis les hooks de
 * matchs) : le hero ne fait AUCUN fetch, il reste purement présentationnel.
 */

import { useMemo, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, CalendarDays, Trophy, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOT } from "@/components/football/fotmob-theme";

// Orange parquet (déco) — texte lisible en #c2410c sur fond clair
const ORANGE = "#f97316";
const ORANGE_INK = "#c2410c";
const CTA = "#00e676";

type BasketballHeroHeaderProps = {
  /** Nombre de matchs actuellement en direct (badge pulse). */
  liveCount?: number;
  /** Nombre de matchs à venir / non commencés. */
  upcomingCount?: number;
  /** Nombre de ligues suivies (NBA, WNBA, EuroLeague, EuroCup…). */
  leagueCount?: number;
  /** CTA — bascule sur le sous-onglet Matchs. */
  onCta?: () => void;
  className?: string;
};

/** Fond mesh grainy orange (miroir hockey/handball, teinte basket). */
function GrainMesh() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            `radial-gradient(900px 380px at 12% -10%, rgba(249,115,22,0.40), transparent 60%),` +
            `radial-gradient(700px 340px at 88% 0%, rgba(0,230,118,0.20), transparent 62%),` +
            `radial-gradient(800px 420px at 55% 115%, rgba(194,65,12,0.16), transparent 65%),` +
            `linear-gradient(180deg, #fffaf5 0%, #fdf3ea 55%, #fffaf5 100%)`,
        }}
      />
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]" aria-hidden>
        <filter id="basketGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#basketGrain)" />
      </svg>
    </>
  );
}

/** Demi-terrain stylisé (cercle central, raquette, arc à 3 points, panier). */
function CourtLines() {
  return (
    <svg
      viewBox="0 0 600 200"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {/* Cercle central */}
      <circle cx="300" cy="100" r="42" fill="none" stroke={ORANGE} strokeWidth="2" opacity="0.28" />
      <circle cx="300" cy="100" r="3" fill={ORANGE_INK} opacity="0.3" />
      {/* Raquette gauche */}
      <rect x="0" y="58" width="86" height="84" fill="none" stroke={ORANGE_INK} strokeWidth="2" opacity="0.22" />
      <circle cx="86" cy="100" r="30" fill="none" stroke={ORANGE_INK} strokeWidth="2" opacity="0.2" />
      {/* Raquette droite */}
      <rect x="514" y="58" width="86" height="84" fill="none" stroke={ORANGE_INK} strokeWidth="2" opacity="0.22" />
      <circle cx="514" cy="100" r="30" fill="none" stroke={ORANGE_INK} strokeWidth="2" opacity="0.2" />
      {/* Arc à 3 points */}
      <path d="M20 22 A 92 92 0 0 1 20 178" fill="none" stroke={ORANGE} strokeWidth="2" opacity="0.22" />
      <path d="M580 22 A 92 92 0 0 0 580 178" fill="none" stroke={ORANGE} strokeWidth="2" opacity="0.22" />
      {/* Panier */}
      <circle cx="42" cy="100" r="6" fill="none" stroke={ORANGE_INK} strokeWidth="2" opacity="0.35" />
      <circle cx="558" cy="100" r="6" fill="none" stroke={ORANGE_INK} strokeWidth="2" opacity="0.35" />
    </svg>
  );
}

/** Ballon glass flottant (animation coupée si reduced motion). */
function BallOrb({
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
        boxShadow: `inset 0 -${size / 5}px ${size / 3}px rgba(194,65,12,0.22), 0 ${size / 6}px ${size / 2.2}px rgba(194,65,12,0.16)`,
        animation: reduceMotion ? undefined : `basketOrbFloat 7s ease-in-out ${delay}s infinite`,
      }}
      aria-hidden
    />
  );
}

function KpiChip({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  tone: "live" | "upcoming" | "leagues";
}) {
  const palette =
    tone === "live"
      ? { bg: "rgba(0,152,95,0.12)", ink: "#007a4d" }
      : tone === "upcoming"
        ? { bg: "rgba(249,115,22,0.14)", ink: ORANGE_INK }
        : { bg: "rgba(34,34,34,0.06)", ink: FOT.ink };

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2"
      style={{ backgroundColor: palette.bg, border: `1px solid ${FOT.border}` }}
    >
      <span style={{ color: palette.ink }} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="font-mono text-sm font-bold tabular-nums" style={{ color: palette.ink }}>
          {value}
        </p>
        <p className="truncate text-[10px] uppercase tracking-[0.12em]" style={{ color: FOT.muted }}>
          {label}
        </p>
      </div>
    </div>
  );
}

export function BasketballHeroHeader({
  liveCount = 0,
  upcomingCount = 0,
  leagueCount = 4,
  onCta,
  className,
}: BasketballHeroHeaderProps) {
  const reduceMotion = useReducedMotion() ?? false;

  const containerVariants = useMemo(
    () => ({ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } }),
    [],
  );
  const itemVariants = useMemo(
    () => ({
      hidden: reduceMotion ? {} : { opacity: 0, y: 14 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const } },
    }),
    [reduceMotion],
  );

  return (
    <section
      className={cn("relative overflow-hidden rounded-2xl", className)}
      style={{ backgroundColor: FOT.card, border: `1px solid ${FOT.border}` }}
      aria-label="Basketball — présentation de l'onglet"
    >
      <style>{`@keyframes basketOrbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@media (prefers-reduced-motion: reduce){span[style*="basketOrbFloat"]{animation:none}}`}</style>
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        <GrainMesh />
        <CourtLines />
        <BallOrb className="right-[7%] top-[10%]" size={84} hue="rgba(249,115,22,0.5)" reduceMotion={reduceMotion} />
        <BallOrb className="right-[24%] top-[54%]" size={50} hue="rgba(0,230,118,0.38)" delay={1.2} reduceMotion={reduceMotion} />
        <BallOrb className="left-[4%] bottom-[10%]" size={36} hue="rgba(194,65,12,0.4)" delay={2.1} reduceMotion={reduceMotion} />
        {/* Voile clair */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(105deg, rgba(255,255,255,0.74) 0%, rgba(255,243,234,0.34) 55%, rgba(255,255,255,0.74) 100%)",
          }}
        />

        <div className="relative px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            {/* Bloc gauche : accroche */}
            <div className="min-w-0 flex-1">
              <motion.div variants={itemVariants} className="flex items-center gap-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: "#1b0f04" }}>
                  <Target className="h-4 w-4" style={{ color: ORANGE }} />
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em]"
                  style={{ backgroundColor: "#1b0f04", color: ORANGE }}
                >
                  Basketball • Prédictions
                </span>
              </motion.div>

              <motion.h1
                variants={itemVariants}
                className="mt-3 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl"
                style={{ color: FOT.ink, letterSpacing: "-0.03em" }}
              >
                Le parquet, les chiffres,
                <br />
                <span style={{ color: ORANGE_INK }}>les picks qui tiennent.</span>
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="mt-3 max-w-lg text-sm leading-relaxed"
                style={{ color: FOT.muted }}
              >
                Modèle <span className="font-semibold" style={{ color: FOT.ink }}>Elo + PPG</span> et value
                bets sur <span className="font-semibold" style={{ color: ORANGE_INK }}>NBA · WNBA · EuroLeague · EuroCup</span> —
                proba, cote et avantage réunis.
              </motion.p>

              <motion.div variants={itemVariants} className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onCta}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{ backgroundColor: CTA, color: "#1b0f04" }}
                >
                  <Target className="h-4 w-4" aria-hidden />
                  Voir les matchs du jour
                </button>
                <div className="flex flex-wrap gap-2">
                  <KpiChip
                    tone="live"
                    icon={<Activity className="h-4 w-4" />}
                    value={String(liveCount)}
                    label="en direct"
                  />
                  <KpiChip
                    tone="upcoming"
                    icon={<CalendarDays className="h-4 w-4" />}
                    value={String(upcomingCount)}
                    label="à venir"
                  />
                  <KpiChip
                    tone="leagues"
                    icon={<Trophy className="h-4 w-4" />}
                    value={String(leagueCount)}
                    label="ligues"
                  />
                </div>
              </motion.div>
            </div>

            {/* Bloc droit : panneau 3 familles de paris (déco, aligné charte) */}
            <motion.div variants={itemVariants} className="shrink-0 lg:max-w-xs w-full">
              <div className="rounded-xl p-4" style={{ backgroundColor: FOT.soft, border: `1px solid ${FOT.border}` }}>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                    <Trophy className="h-4 w-4" style={{ color: ORANGE_INK }} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: FOT.muted }}>
                    3 familles de paris
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    { label: "Vainqueur (moneyline)", desc: "Elo + avantage domicile" },
                    { label: "Over / Under points", desc: "Ligne totale et rythme PPG" },
                    { label: "Value EV+", desc: "Edge positif, mise Kelly" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                      style={{ border: `1px solid ${FOT.border}` }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold" style={{ color: FOT.ink }}>
                          {s.label}
                        </p>
                        <p className="truncate text-[10px]" style={{ color: FOT.muted }}>
                          {s.desc}
                        </p>
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
